<?php
// knp-snappy driving the binary for real: its own test suite only uses
// mocks. Usage: php snappy-smoke.php <vendor/autoload.php> <binary>
require $argv[1];

use Knp\Snappy\Pdf;

$pdf = new Pdf($argv[2]);
$failures = 0;
$check = function ($name, $ok) use (&$failures) {
    echo ($ok ? 'ok' : 'FAILED') . " - $name\n";
    if (!$ok) $failures++;
};
$isPdf = fn ($s) => is_string($s) && strncmp($s, '%PDF-', 5) === 0;

// knp-snappy passes --lowquality on every call, by default.
$check('getOutputFromHtml', $isPdf($pdf->getOutputFromHtml('<h1>Snappy</h1>')));
$check('getOutputFromHtml with options', $isPdf($pdf->getOutputFromHtml('<h1>Snappy</h1>', [
    'page-size' => 'A5', 'orientation' => 'Landscape', 'encoding' => 'UTF-8', 'margin-top' => '15mm',
    'footer-center' => '[page]/[topage]', 'footer-font-size' => 8, 'no-outline' => true, 'title' => 'T',
    'javascript-delay' => 50, 'enable-local-file-access' => true, 'replace' => ['name' => 'value'],
])));
$tmp = sys_get_temp_dir() . '/snappy-smoke-' . getmypid();
@mkdir($tmp);
file_put_contents("$tmp/page.html", '<h1>File</h1>');
$pdf->generate("$tmp/page.html", "$tmp/out.pdf", [], true);
$check('generate from a file', $isPdf(@file_get_contents("$tmp/out.pdf")));
$pdf->generateFromHtml(['<h1>One</h1>', '<h1>Two</h1>'], "$tmp/multi.pdf", [], true);
$check('several pages', $isPdf(@file_get_contents("$tmp/multi.pdf")));
$pdf->generateFromHtml('<h1>Cover?</h1>', "$tmp/cover.pdf", ['cover' => '<h1>Cover</h1>', 'header-html' => '<!doctype html><p>head</p>'], true);
$check('cover and header-html given as HTML', $isPdf(@file_get_contents("$tmp/cover.pdf")));
try {
    $pdf->generate('http://pdfkiln-nonexistent.invalid/', "$tmp/none.pdf", [], true);
    $check('an unknown host throws', false);
} catch (RuntimeException $e) {
    $check('an unknown host throws', true);
}
exit($failures ? 1 : 0);
