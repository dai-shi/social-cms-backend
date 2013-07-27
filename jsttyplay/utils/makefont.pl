#!/usr/bin/perl
use warnings;
use strict;
$| = 1;

my ($input, $outimage, $outstats) = @ARGV;
die "need an input file" unless $input;
die "need an output image file" unless $outimage;
die "need an output stats file" unless $outstats;

die "output image file must have extension .png" unless $outimage =~ /\.png$/;

my $skipped = 0;

my %font_map;
my $font_width;
my $font_height;

sub parse_char {
    my ($char, $line) = @_;
    my @lines = grep { defined and length } split /\n/, $char;

    my $header = shift @lines;

    my $unicode_value;

    if ( $header =~ /^U\+([a-fA-F0-9]{4})$/ ) {
        $unicode_value = unpack "n", pack "H*", $1;
    } elsif ( length $header == 1 ) {
        $unicode_value = ord $header;
    } elsif ( $header =~ /^"(.)"$/ ) {
        $unicode_value = ord $1;
    } elsif ( $header =~ /^'(.)'$/ ) {
        $unicode_value = ord $1;
    } elsif ( $header eq "TODO" or $header eq "SKIP" ) {
        $skipped++;
        return;
    } else {
        die "can't handle a header of \"$header\" (line $line)";
    }

    my $height = @lines;
    my $width = length $lines[0];
    
    length $lines[$_] == $width or die "Non-rectangular character \"$header\" (line $line)"
        for 0 .. $#lines;

    $font_width  = $width  unless defined $font_width;
    $font_height = $height unless defined $font_height;

    die "Character dimensions (${width}x${height}) for \"$header\" do not match font dimensions (${font_width}x${font_height}) (line $line)"
        if $font_width != $width or $font_height != $height;

    tr/[., ]/0/, tr/[1X@MOSW]/1/ for @lines;

    ($_ ne '1' and $_ ne '0') and die "Bad character value '$_' for \"$header\" (line $line)"
        for map split(//, $_), @lines;

    $font_map{$unicode_value} = \@lines;
}

open my $lf, "<", $ARGV[0] or die;
my $char_data = '';
my $char_line_no;
my $line_no = 0;
while ( <$lf> ) {
    chomp;
    s/\s*#.*$//;
    if ( length ) {
        $char_line_no = $line_no unless defined $char_line_no;
        $char_data .= "$_\n";
    } elsif ( length $char_data ) {
        parse_char($char_data, $char_line_no);
        $char_data = '';
        undef $char_line_no;
    }
}
parse_char($char_data) if length $char_data;
close $lf;

print STDERR "Characters: parsed ".scalar(keys %font_map).", skipped $skipped\n";
print STDERR "Font size: ${font_width}x${font_height}\n";

my @codepoints = sort { $a <=> $b } keys %font_map;

my $width = int sqrt int scalar @codepoints;
$width = 8 if $width < 8;

print STDERR "Building image and stats...\n";
open my $sf, ">", $outstats or die;

my $this_ch_x = 0;
my $this_ch_y = 0;
my $image_data = '';
my @row_bits = map +("0" x ($width*$font_width)), 1..$font_height;
my $last_cp = 0;
my $cp_run = 0;
sub flush_run {
    if ( $cp_run ) {
        print $sf "r$cp_run\n";
        $cp_run = 0;
    }
}
for my $idx ( 0 .. $#codepoints ) {
    my $cp = $codepoints[$idx];

    # flush this row to the pbm buffer if neccessary
    if ( $this_ch_x == $width ) {
        $this_ch_y++;
        $this_ch_x = 0;
        for my $row ( @row_bits ) {
            $row .= "0" while length($row) % 8 != 0;
            $image_data .= pack "B*", $row;
            $row = "0" x ($width*$font_width);
        }
        print "image data length: ".length($image_data)."\n";
        flush_run();
        print $sf "y\n";
    }


    # add the character to this image row
    if ( $last_cp + 1 == $cp ) {
        $cp_run++;
        $last_cp = $cp;
    } else {
        flush_run();
        print $sf "$cp\n";
        $last_cp = $cp;
    }

    for my $row ( 0 .. $font_height-1 ) {
        substr($row_bits[$row], $this_ch_x*$font_width, $font_width, $font_map{$cp}[$row]);
    }

    $this_ch_x++;
}

flush_run();

if ( $this_ch_x ) {
    # we have put a character on the last line
    for my $row ( @row_bits ) {
        $row .= "0" while length($row) % 8 != 0;
        $image_data .= pack "B*", $row;
    }
}

close $sf;

print STDERR "Converting image to png...\n";

open $sf, "|-", "convert", "pbm:-", "png:$outimage" or die;
print $sf "P4 ".($font_width * $width)." ".(($this_ch_y+1) * $font_height)." ".$image_data;
close $sf;

print STDERR "Done.\n";

