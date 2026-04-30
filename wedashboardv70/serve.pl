use strict;
use HTTP::Daemon;
use HTTP::Status;
use File::Basename;

my $port = $ENV{PORT} || 8080;
my $root = "C:/Users/User/Documents/DASHBOARD";

my %mime = (
    html => 'text/html; charset=utf-8',
    css  => 'text/css',
    js   => 'application/javascript',
    json => 'application/json',
    png  => 'image/png',
    jpg  => 'image/jpeg',
    svg  => 'image/svg+xml',
    ico  => 'image/x-icon',
);

my $d = HTTP::Daemon->new(LocalAddr => '127.0.0.1', LocalPort => $port, ReuseAddr => 1)
    or die "Cannot start server: $!";

print "Listening on " . $d->url . "\n";
$| = 1;

while (my $c = $d->accept) {
    while (my $r = $c->get_request) {
        my $path = $r->url->path;
        $path = '/dashboard.html' if $path eq '/';
        $path =~ s|[^a-zA-Z0-9._/\-]||g;

        my $file = "$root$path";

        if (-f $file) {
            my ($ext) = $file =~ /\.([^.]+)$/;
            my $type = $mime{lc($ext) || ''} || 'application/octet-stream';
            $c->send_file_response($file);
        } else {
            $c->send_error(RC_NOT_FOUND);
        }
    }
    $c->close;
    undef $c;
}
