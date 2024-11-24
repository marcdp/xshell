using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace XShell.Mpa.Sample.Controllers
{
    [Route("/api")]
    [ApiController]
    public class Config : ControllerBase
    {
        [HttpGet("config")]
        public IActionResult Get() {
            var config = new XShell.Mpa.Config.XShell();


            return Ok(config);
        }
    }
}
