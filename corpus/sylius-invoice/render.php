<?php
// Renders the Sylius invoice and credit memo PDF templates with sample data,
// the way TwigToPdfGenerator does before handing the HTML to knp-snappy.
namespace Sylius\InvoicingPlugin\Entity { interface InvoiceInterface { const PAYMENT_STATE_COMPLETED = 'completed'; } }
namespace {
require __DIR__ . '/vendor/autoload.php';
use Symfony\Component\Yaml\Yaml;

// usage: php render.php <dir with inv/ (InvoicingPlugin) and refund/ (RefundPlugin) clones> <out dir>
[$_, $src, $out] = $argv;
$core = [ // Sylius core labels used by the templates (SyliusUiBundle messages)
  'fr' => ['sylius.ui.name' => 'Nom', 'sylius.ui.quantity' => 'Quantité', 'sylius.ui.currency' => 'Devise', 'sylius.ui.total' => 'Total'],
  'en' => ['sylius.ui.name' => 'Name', 'sylius.ui.quantity' => 'Quantity', 'sylius.ui.currency' => 'Currency', 'sylius.ui.total' => 'Total'],
];
function flatten($a, $p = '') { $r = []; foreach ($a as $k => $v) { if (is_array($v)) $r += flatten($v, "$p$k."); else $r["$p$k"] = $v; } return $r; }
$messages = [];
foreach (['fr', 'en'] as $l) {
  $messages[$l] = $core[$l]
    + flatten(Yaml::parseFile("$src/inv/translations/messages.$l.yml"))
    + flatten(Yaml::parseFile("$src/refund/translations/messages.$l.yml"));
}
$loader = new \Twig\Loader\FilesystemLoader();
$loader->addPath("$src/inv/templates", 'SyliusInvoicingPlugin');
$loader->addPath("$src/refund/templates", 'SyliusRefundPlugin');
$twig = new \Twig\Environment($loader, ['strict_variables' => false]);
$twig->addFilter(new \Twig\TwigFilter('trans', fn($id, $p = [], $d = null, $l = 'en') => $messages[substr($l, 0, 2)][$id] ?? $id));
$countries = ['FR' => 'France', 'PL' => 'Pologne', 'US' => 'United States'];
$twig->addFilter(new \Twig\TwigFilter('sylius_country_name', fn($c) => $countries[$c] ?? $c));

class Obj { function __construct(private array $d) {} function __get($k) { return $this->d[$k] ?? null; } function __isset($k) { return isset($this->d[$k]); }
  function __call($k, $a) { $v = $this->d[$k] ?? null; return $v instanceof \Closure ? $v() : $v; } }
class Items extends ArrayObject { function count(): int { return parent::count(); } }

$products = [
  ['Bonnet en laine bordeaux', 'Taille unique', 2, 2450, 2205],
  ['Robe d’été beige à bretelles', 'M', 1, 5990, 5990],
  ['T-shirt basique coton bio « Everyday »', 'L', 3, 1890, 1701],
  ['Jean slim délavé', '38', 1, 7490, 7490],
  ['Écharpe à carreaux', null, 1, 2990, 2691],
  ['Sweat à capuche gris chiné', 'XL', 2, 4590, 4590],
  ['Chaussettes rayées (lot de 3)', null, 4, 1290, 1290],
  ['Veste en jean doublée sherpa', 'M', 1, 11990, 10791],
  ['Ceinture cuir marron', '95 cm', 1, 3490, 3490],
  ['Livraison DHL Express', null, 1, 990, 990],
];
$lines = []; $sub = 0; $tax = 0;
foreach ($products as [$name, $variant, $q, $unit, $disc]) {
  $net = $q * $disc; $t = (int) round($net * 0.2); $sub += $net; $tax += $t;
  $lines[] = new Obj(['name' => $name, 'variantName' => $variant, 'quantity' => $q, 'unitPrice' => $unit, 'discountedUnitNetPrice' => $disc,
    'subtotal' => $net, 'taxRate' => '20%', 'taxTotal' => $t, 'total' => $net + $t]);
}
$invoice = new Obj([
  'number' => '2026/10/000042', 'localeCode' => 'fr_FR', 'currencyCode' => 'EUR', 'issuedAt' => new DateTime('2026-10-21 14:32:08'),
  'billingData' => new Obj(['firstName' => 'Élodie', 'lastName' => 'Marchand', 'company' => 'Atelier Marchand SARL', 'street' => '12 rue des Tanneurs',
    'city' => 'Lyon', 'countryCode' => 'FR', 'postcode' => '69002']),
  'shopBillingData' => new Obj(['company' => 'Sylius Fashion Store', 'street' => '8 avenue de la République', 'city' => 'Paris',
    'taxId' => 'FR 40 123456789', 'countryCode' => 'FR', 'postcode' => '75011']),
  'lineItems' => $lines, 'subtotal' => $sub, 'taxesTotal' => $tax, 'total' => $sub + $tax,
  'paymentState' => fn() => 'completed',
  'taxItems' => new Items([new Obj(['label' => 'TVA (20%)', 'amount' => $tax])]),
]);
file_put_contents("$out/invoice.html", $twig->render('@SyliusInvoicingPlugin/shared/download/pdf.html.twig',
  ['invoice' => $invoice, 'invoiceLogoPath' => 'sylius-logo.png']));

$refunds = [['Robe d’été beige à bretelles', 1, 4992, 998], ['Chaussettes rayées (lot de 3)', 2, 2150, 430], ['Livraison DHL Express', 1, 825, 165]];
$items = []; $net = 0; $taxT = 0;
foreach ($refunds as [$name, $q, $n, $t]) { $net += $n; $taxT += $t;
  $items[] = new Obj(['name' => $name, 'quantity' => $q, 'unitNetPrice' => intdiv($n, $q), 'netValue' => $n, 'taxRate' => '20%', 'taxAmount' => $t, 'grossValue' => $n + $t]); }
$memo = new Obj([
  'number' => '2026/10/000007', 'localeCode' => 'en_US', 'currencyCode' => 'EUR', 'issuedAt' => new DateTime('2026-10-22 09:05:41'),
  'from' => new Obj(['fullName' => 'Élodie Marchand', 'company' => 'Atelier Marchand SARL', 'street' => '12 rue des Tanneurs', 'city' => 'Lyon',
    'provinceName' => null, 'countryCode' => 'FR', 'postcode' => '69002']),
  'to' => new Obj(['company' => 'Sylius Fashion Store', 'street' => '8 avenue de la République', 'city' => 'Paris', 'taxId' => 'FR 40 123456789',
    'countryCode' => 'FR', 'postcode' => '75011']),
  'lineItems' => $items, 'total' => $net + $taxT, 'getNetValueTotal' => fn() => $net, 'getTaxTotal' => fn() => $taxT,
  'taxItems' => [new Obj(['label' => 'VAT (20%)', 'amount' => $taxT])], 'comment' => 'Partial refund for order #000001042: two items returned.',
]);
file_put_contents("$out/credit_memo.html", $twig->render('@SyliusRefundPlugin/download/credit_memo.html.twig',
  ['creditMemo' => $memo, 'creditMemoLogoPath' => 'sylius-logo.png']));
}
