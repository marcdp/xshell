using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace XShell.Mpa.Sample.Controllers
{
    [Route("/api")]
    [ApiController]
    public class Test : ControllerBase
    {
        [HttpGet("test")]
        public IActionResult Get() {
            return Ok(new string[] { "value1", "value2" });
        }
    }
}
