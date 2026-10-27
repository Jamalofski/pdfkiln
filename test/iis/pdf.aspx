<%@ Page Language="C#" %>
<%@ Import Namespace="System.Diagnostics" %>
<%@ Import Namespace="System.IO" %>
<script runat="server">
// wkhtmltopdf called from a page, as Rotativa and the other .NET Framework
// libraries do: HTML on standard input, the PDF on standard output, run as
// the application pool's identity (CI job dotnet). The identity and its
// folders go in response headers; on failure, the exit code and standard
// error in plain text.
protected void Page_Load(object sender, EventArgs e)
{
    Response.AppendHeader("X-Identity", System.Security.Principal.WindowsIdentity.GetCurrent().Name);
    Response.AppendHeader("X-Profile", Environment.GetEnvironmentVariable("USERPROFILE") ?? "");
    Response.AppendHeader("X-Temp", Path.GetTempPath());
    var psi = new ProcessStartInfo(Server.MapPath("~/wkhtmltopdf/bin/wkhtmltopdf.exe"), "-q - -");
    psi.UseShellExecute = false;
    psi.CreateNoWindow = true;
    psi.RedirectStandardInput = true;
    psi.RedirectStandardOutput = true;
    psi.RedirectStandardError = true;
    using (var p = Process.Start(psi))
    {
        var pdf = new MemoryStream();
        var copy = p.StandardOutput.BaseStream.CopyToAsync(pdf);
        var err = p.StandardError.ReadToEndAsync();
        p.StandardInput.Write("<h1>IIS</h1>");
        p.StandardInput.Close();
        if (!p.WaitForExit(90000)) p.Kill();
        p.WaitForExit();
        copy.Wait();
        if (p.ExitCode == 0)
        {
            Response.ContentType = "application/pdf";
            pdf.WriteTo(Response.OutputStream);
        }
        else
        {
            Response.TrySkipIisCustomErrors = true;
            Response.StatusCode = 500;
            Response.ContentType = "text/plain";
            Response.Write(string.Format("exit code {0}\n{1}", p.ExitCode, err.Result));
        }
    }
}
</script>
