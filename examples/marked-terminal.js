const galactica = require("../")

const screen = galactica.screen()
const markdown = galactica.markdown()
screen.append(markdown)
markdown.setMarkdown("- [x] Checkbox")
screen.render()
