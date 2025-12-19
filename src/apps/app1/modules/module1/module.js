export default {
    onCommand(command, params) {
        if (command == "load") {
            // module load
            console.log(`module: ${this.name} loaded`);
        }
    }
};