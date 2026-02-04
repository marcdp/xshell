
// class
export default {
    meta: {
        title: "Sample Page 7",
        icon: "icon-sample7",
        description: "This is a sample page 7 description"
    },
    template: `
        <p>This is sample page <b>7</b><br/></p>
        <hr/>
        navigation page relative: <a href="page8.js">Link</a><br/>
        navigation module relative: <a href="/pages/page8.js">Link</a><br/>
        <hr/>
        resource page relative:<img src="../images/apple.jpg" style="width:2em"/><br/>
        resource module relative:<img src="/images/apple.jpg" style="width:2em"/><br/>
        <hr/>
        <br/>
        <button ref="btn1">Do Something</button>
    `,
    style: `
        p {display:block; border:1px red solid;}
    `,
    state: {
        var1: "value1",
        var2: "value2"
    },
    script({ bus, state }) {
        return {
            onCommand(command, params) {
                if (command == "load") {
                    //load
                    state.var1 = "holaaa";
                    
                } else if (command == "mount") { 
                    // mount
                    this.refs.btn1.innerHTML = state.var1;
                    this.bindEvent(this.refs.btn1, "click", "do-something");
                    this.refs.btn1.style.border = "2px solid blue";

                } else if (command == "do-something") { 
                    // todo ...
                    alert("aaa2")
                }
            }
        }
    }
};

