// Rotativa.AspNetCore's driver, called as its ViewAsPdf calls it once the
// view is rendered: the folder of wkhtmltopdf.exe, the switches, and the
// page's HTML (CI job dotnet).
//
//   dotnet run --project test/rotativa -- <folder of wkhtmltopdf.exe>
using System;
using Rotativa.AspNetCore;

var pdf = WkhtmltopdfDriver.ConvertHtml(args[0], "-q --page-size A4 --footer-center [page]/[topage]", "<h1>Rotativa</h1>");
if (pdf.Length < 5 || System.Text.Encoding.ASCII.GetString(pdf, 0, 5) != "%PDF-")
{
    Console.Error.WriteLine("Rotativa.AspNetCore: not a PDF");
    return 1;
}
Console.WriteLine($"Rotativa.AspNetCore: a PDF of {pdf.Length} bytes");
return 0;
