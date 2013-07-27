#!/usr/bin/perl
use warnings;
use strict;

# convert from *unicode* x11 bdf files to the font description used in makefont.pl

die "Usage: perl $0 < input.bcf > output.txt" if -t STDIN or @ARGV;

sub handle_char {
    my ($char) = @_;

    my $bitmap_data;
    my $codepoint;
    my ($bbx_h, $bbx_w, $bbx_x, $bbx_y);

    for ( grep { defined and length } split /\n/, $char ) {
        if ( /^ENCODING (\d+)$/ ) {
            $codepoint = $1;
        } elsif ( /^BBX\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/ ) {
            ($bbx_w, $bbx_h, $bbx_x, $bbx_y) = ($1,$2,$3,$4);
        } elsif ( /^BITMAP(.*)$/ ) {
            $bitmap_data = $1;
        } elsif ( defined $bitmap_data ) {
            $bitmap_data .= "\n$_";
        }
    }

    die "bad char: no bitmap\n$char" unless defined $bitmap_data;
    die "bad char: no codepoint\n$char" unless defined $codepoint;
    die "bad char: no bounding box\n$char" unless defined $bbx_h;

    print "\nU+".unpack("H4", pack "n", $codepoint)."\n";
    for my $row ( grep { defined and length } split /\s+/, $bitmap_data ) {
        my $bits = unpack "B*", pack "H*", $row;
        $bits = substr $bits, 0, $bbx_w; # doesn't work??
        $bits =~ tr/01/.X/;
        print "$bits\n";
    }
}

print "# generated with bdf2fontdescr.pl\n";

my $char;
while ( <STDIN> ) {
    tr/[\r\n]//d;

    if ( /^FONT (.+)$/ ) {
        warn "Font does not appear to be an ISO10646 (Unicode) font.\n"
            if !/-ISO10646-/i && !/-iso8859-1/i; # ISO8859-1 has the same codepoints
    } elsif ( /^STARTCHAR/ ) {
        $char = '';
    } elsif ( /^ENDCHAR/ ) {
        handle_char($char);
        undef $char;
    } elsif ( /^COMMENT (.+)$/ ) {
        print "# $1\n";
    } elsif ( defined $char ) {
        $char .= $_."\n";
    }
}

