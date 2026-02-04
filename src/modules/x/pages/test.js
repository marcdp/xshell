export default {
    script({ state }) {
        return {
            onCommand(command, params) {
                if (command == "load") {
                    // load
                } else if (command == "inc1"){
                    // inc
                    state.var1 += 1;
                }                
            }
        };
    }
};
