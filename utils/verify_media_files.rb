#!/usr/bin/env ruby
# frozen_string_literal: true

# Media File Verification Utility
# Verifies that song file paths in the database point to existing files
# Usage: ruby utils/verify_media_files.rb [--fix] [--verbose]

require 'sqlite3'
require 'pathname'
require 'json'

class MediaFileVerifier
  attr_reader :db_path, :media_root, :fix_mode, :verbose

  def initialize(options = {})
    @db_path = options[:db_path] || 'database.db'
    @media_root = options[:media_root] || 'public'
    @fix_mode = options[:fix] || false
    @verbose = options[:verbose] || false
  end

  def run
    puts "\n=== Media File Verification Utility ==="
    puts "Database: #{db_path}"
    puts "Media Root: #{media_root}"
    puts "Fix Mode: #{fix_mode ? 'ENABLED' : 'DISABLED'}"
    puts "=" * 40
    puts

    db = SQLite3::Database.new(db_path)
    db.results_as_hash = true

    results = {
      total_songs: 0,
      valid_files: 0,
      missing_files: 0,
      null_paths: 0,
      orphaned_files: 0,
      fixed: 0
    }

    # Check songs table
    check_songs(db, results)

    # Check media_files table if it exists
    check_media_files(db, results) if table_exists?(db, 'media_files')

    # Find orphaned files (files on disk not in database)
    check_orphaned_files(db, results)

    # Print summary
    print_summary(results)

    db.close
    
    exit(results[:missing_files] > 0 ? 1 : 0)
  end

  private

  def check_songs(db, results)
    puts "\n--- Checking Songs Table ---"
    
    songs = db.execute('SELECT id, title, file_path, file_format FROM songs')
    results[:total_songs] = songs.length

    songs.each do |song|
      song_id = song['id']
      title = song['title']
      file_path = song['file_path']
      file_format = song['file_format']

      if file_path.nil? || file_path.strip.empty?
        results[:null_paths] += 1
        log_verbose "⚠️  Song ##{song_id} '#{title}': No file path set"
        next
      end

      full_path = File.join(media_root, file_path)
      
      if File.exist?(full_path)
        results[:valid_files] += 1
        log_verbose "✓ Song ##{song_id} '#{title}': #{file_path}"
        
        # Update verification timestamp in media_files if exists
        if fix_mode && table_exists?(db, 'media_files')
          update_verification(db, 'song', song_id)
        end
      else
        results[:missing_files] += 1
        puts "✗ Song ##{song_id} '#{title}': MISSING FILE"
        puts "  Expected: #{full_path}"
        
        if fix_mode
          # Try to find the file
          found_path = find_missing_file(title, file_format)
          if found_path
            relative_path = found_path.sub(/^#{Regexp.escape(media_root)}\//, '')
            db.execute('UPDATE songs SET file_path = ? WHERE id = ?', [relative_path, song_id])
            puts "  → Fixed: #{relative_path}"
            results[:fixed] += 1
          else
            puts "  → Could not auto-fix"
          end
        end
      end
    end
  end

  def check_media_files(db, results)
    puts "\n--- Checking Media Files Table ---"
    
    media_files = db.execute('SELECT id, entity_type, entity_id, file_path, is_verified FROM media_files')
    
    media_files.each do |file|
      file_id = file['id']
      file_path = file['file_path']
      full_path = File.join(media_root, file_path)
      
      if File.exist?(full_path)
        log_verbose "✓ Media File ##{file_id}: #{file_path}"
        
        if fix_mode && file['is_verified'] == 0
          update_media_file_verification(db, file_id)
        end
      else
        puts "✗ Media File ##{file_id}: MISSING"
        puts "  Expected: #{full_path}"
      end
    end
  end

  def check_orphaned_files(db, results)
    puts "\n--- Checking for Orphaned Files ---"
    
    audio_dir = File.join(media_root, 'media', 'audio')
    return unless Dir.exist?(audio_dir)

    # Get all file paths from database
    db_paths = db.execute('SELECT file_path FROM songs WHERE file_path IS NOT NULL')
                  .map { |row| row['file_path'] }
                  .to_set

    # Find all audio files on disk
    audio_extensions = %w[.mp3 .wav .aiff .aac .flac .ogg]
    
    Dir.glob(File.join(audio_dir, '**', '*')).each do |file_path|
      next unless File.file?(file_path)
      next unless audio_extensions.include?(File.extname(file_path).downcase)
      
      relative_path = file_path.sub(/^#{Regexp.escape(media_root)}\//, '')
      
      unless db_paths.include?(relative_path)
        results[:orphaned_files] += 1
        puts "⚠️  Orphaned File: #{relative_path}"
      end
    end
  end

  def find_missing_file(title, format)
    # Try to find file by title in media directory
    audio_dir = File.join(media_root, 'media', 'audio')
    return nil unless Dir.exist?(audio_dir)

    sanitized_title = sanitize_filename(title)
    pattern = File.join(audio_dir, '**', "*#{sanitized_title}*.#{format || '*'}")
    
    matches = Dir.glob(pattern, File::FNM_CASEFOLD)
    matches.first
  end

  def sanitize_filename(text)
    text.downcase
        .gsub(/[^a-z0-9\s-]/, '')
        .gsub(/\s+/, '-')
  end

  def update_verification(db, entity_type, entity_id)
    db.execute(
      'UPDATE media_files SET is_verified = 1, last_verified_at = datetime("now") WHERE entity_type = ? AND entity_id = ?',
      [entity_type, entity_id]
    )
  end

  def update_media_file_verification(db, file_id)
    db.execute(
      'UPDATE media_files SET is_verified = 1, last_verified_at = datetime("now") WHERE id = ?',
      [file_id]
    )
  end

  def table_exists?(db, table_name)
    result = db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [table_name]
    )
    !result.empty?
  end

  def log_verbose(message)
    puts message if verbose
  end

  def print_summary(results)
    puts "\n" + "=" * 40
    puts "SUMMARY"
    puts "=" * 40
    puts "Total Songs: #{results[:total_songs]}"
    puts "Valid Files: #{results[:valid_files]}"
    puts "Missing Files: #{results[:missing_files]}"
    puts "Null/Empty Paths: #{results[:null_paths]}"
    puts "Orphaned Files: #{results[:orphaned_files]}"
    puts "Fixed: #{results[:fixed]}" if fix_mode
    puts "=" * 40
    
    if results[:missing_files] > 0
      puts "\n⚠️  WARNING: #{results[:missing_files]} missing file(s) detected!"
      puts "Run with --fix to attempt automatic repair."
    elsif results[:orphaned_files] > 0
      puts "\n⚠️  WARNING: #{results[:orphaned_files]} orphaned file(s) found!"
    else
      puts "\n✓ All files verified successfully!"
    end
  end
end

# Parse command line arguments
options = {
  fix: ARGV.include?('--fix'),
  verbose: ARGV.include?('--verbose') || ARGV.include?('-v')
}

# Run verifier
verifier = MediaFileVerifier.new(options)
verifier.run
