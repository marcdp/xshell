using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace XShell.Mpa.Sample.Module2.Controllers
{
    [Route("/api")]
    [ApiController]
    public class ValuesController : ControllerBase
    {
        [HttpGet("test3")]
        public IActionResult Get() {
            return Ok(new string[] { "value5", "value6" });
        }
    }
}
