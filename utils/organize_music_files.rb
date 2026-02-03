#!/usr/bin/env ruby
# frozen_string_literal: true

# File Organization Utility
# Organizes audio files into structured folders: media/music_files/Artist-Name/Album-Name/songs
# Usage: ruby utils/organize_music_files.rb [--dry-run] [--source-dir path]

require 'sqlite3'
require 'fileutils'
require 'pathname'

class MusicFileOrganizer
  attr_reader :db_path, :source_dir, :target_base, :dry_run

  def initialize(options = {})
    @db_path = options[:db_path] || 'database.db'
    @source_dir = options[:source_dir] || 'public/media/audio'
    @target_base = options[:target_base] || 'public/media/music_files'
    @dry_run = options[:dry_run] || false
  end

  def run
    puts "\n=== Music File Organization Utility ==="
    puts "Database: #{db_path}"
    puts "Source: #{source_dir}"
    puts "Target: #{target_base}"
    puts "Mode: #{dry_run ? 'DRY RUN' : 'LIVE'}"
    puts "=" * 50
    puts

    db = SQLite3::Database.new(db_path)
    db.results_as_hash = true

    # Get all albums with songs
    albums = get_albums_with_songs(db)
    
    stats = {
      albums_processed: 0,
      files_moved: 0,
      files_skipped: 0,
      errors: 0
    }

    albums.each do |album|
      process_album(db, album, stats)
    end

    # Handle standalone songs (not part of any album)
    process_standalone_songs(db, stats)

    print_summary(stats)
    db.close
  end

  private

  def get_albums_with_songs(db)
    # Get all music products (Albums, Singles, EPs) with at least one song
    query = <<-SQL
      SELECT DISTINCT 
        p.id as album_id,
        p.title as album_title,
        p.artist,
        p.type,
        COUNT(asong.song_id) as song_count
      FROM products p
      INNER JOIN album_songs asong ON p.id = asong.album_id
      WHERE p.type IN ('Album', 'Single', 'EP')
      GROUP BY p.id
      ORDER BY p.artist, p.title
    SQL

    db.execute(query)
  end

  def process_album(db, album, stats)
    album_id = album['album_id']
    album_title = album['album_title']
    artist_name = album['artist']
    
    puts "\n--- Processing: #{artist_name} - #{album_title} ---"
    
    # Create target directory structure
    artist_dir = sanitize_dirname(artist_name)
    album_dir = sanitize_dirname(album_title)
    target_dir = File.join(target_base, artist_dir, album_dir)
    
    unless dry_run
      FileUtils.mkdir_p(target_dir)
    end
    
    puts "Target: #{target_dir}"
    
    # Get songs for this album
    songs = db.execute(
      <<-SQL,
        SELECT 
          s.id,
          s.title,
          s.file_path,
          s.file_format,
          asong.track_number,
          asong.disc_number
        FROM songs s
        INNER JOIN album_songs asong ON s.id = asong.song_id
        WHERE asong.album_id = ?
        ORDER BY asong.disc_number, asong.track_number
      SQL
      album_id
    )
    
    songs.each do |song|
      move_song_file(db, song, target_dir, stats)
    end
    
    stats[:albums_processed] += 1
  end

  def process_standalone_songs(db, stats)
    puts "\n--- Processing Standalone Songs ---"
    
    # Find songs not in album_songs table (using NOT EXISTS for efficiency)
    standalone_query = <<-SQL
      SELECT 
        s.id,
        s.title,
        s.file_path,
        s.file_format
      FROM songs s
      WHERE NOT EXISTS (
        SELECT 1 
        FROM album_songs asong 
        WHERE asong.song_id = s.id
      )
      AND s.file_path IS NOT NULL
    SQL
    
    standalone_songs = db.execute(standalone_query)
    
    if standalone_songs.empty?
      puts "No standalone songs found."
      return
    end
    
    puts "Found #{standalone_songs.length} standalone song(s)"
    
    # Create Singles directory
    target_dir = File.join(target_base, 'Singles')
    
    unless dry_run
      FileUtils.mkdir_p(target_dir)
    end
    
    standalone_songs.each do |song|
      move_song_file(db, song, target_dir, stats)
    end
  end

  def move_song_file(db, song, target_dir, stats)
    song_id = song['id']
    title = song['title']
    file_path = song['file_path']
    file_format = song['file_format'] || 'mp3'
    track_number = song['track_number']
    
    if file_path.nil? || file_path.strip.empty?
      puts "  ⊘ Skipping '#{title}': No file path"
      stats[:files_skipped] += 1
      return
    end
    
    source_file = File.join('public', file_path)
    
    unless File.exist?(source_file)
      puts "  ✗ '#{title}': Source file not found (#{source_file})"
      stats[:errors] += 1
      return
    end
    
    # Generate new filename
    track_prefix = track_number ? sprintf('%02d', track_number) : ''
    sanitized_title = sanitize_filename(title)
    new_filename = track_prefix.empty? ? 
      "#{sanitized_title}.#{file_format}" :
      "#{track_prefix}-#{sanitized_title}.#{file_format}"
    
    target_file = File.join(target_dir, new_filename)
    
    # Calculate relative path from public/
    relative_path = Pathname.new(target_file).relative_path_from(Pathname.new('public')).to_s
    
    if dry_run
      puts "  [DRY RUN] Would move:"
      puts "    From: #{file_path}"
      puts "    To: #{relative_path}"
    else
      begin
        FileUtils.mv(source_file, target_file)
        
        # Update database with new path
        db.execute('UPDATE songs SET file_path = ? WHERE id = ?', [relative_path, song_id])
        
        # Update media_files table if it exists
        db.execute(
          'UPDATE media_files SET file_path = ? WHERE entity_type = ? AND entity_id = ?',
          [relative_path, 'song', song_id]
        )
        
        puts "  ✓ Moved '#{title}' → #{new_filename}"
        stats[:files_moved] += 1
      rescue => e
        puts "  ✗ Error moving '#{title}': #{e.message}"
        stats[:errors] += 1
      end
    end
  end

  def sanitize_dirname(text)
    text.strip
        .gsub(/[^\w\s-]/, '')
        .gsub(/\s+/, '-')
        .gsub(/-+/, '-')
  end

  def sanitize_filename(text)
    text.strip
        .gsub(/[^\w\s-]/, '')
        .gsub(/\s+/, '-')
        .gsub(/-+/, '-')
        .downcase
  end

  def print_summary(stats)
    puts "\n" + "=" * 50
    puts "SUMMARY"
    puts "=" * 50
    puts "Albums Processed: #{stats[:albums_processed]}"
    puts "Files Moved: #{stats[:files_moved]}"
    puts "Files Skipped: #{stats[:files_skipped]}"
    puts "Errors: #{stats[:errors]}"
    puts "=" * 50
    
    if dry_run
      puts "\n✓ Dry run completed. Run without --dry-run to execute."
    elsif stats[:errors] > 0
      puts "\n⚠️  Completed with #{stats[:errors]} error(s)."
    else
      puts "\n✓ All files organized successfully!"
    end
  end
end

# Parse command line arguments
options = {
  dry_run: ARGV.include?('--dry-run'),
  source_dir: ARGV.find { |arg| arg.start_with?('--source-dir=') }&.split('=', 2)&.last
}

# Run organizer
organizer = MusicFileOrganizer.new(options)
organizer.run
