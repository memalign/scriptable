// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: book-open;
// Made by @memalign - 1/1/19
// Copyright 2019

// First, convert ebook to text using http://www.convertfiles.com/convert/ebook/EPUB-to-TXT.html
// Then, using Files, save the result to Scriptable's space


let fm = FileManager.iCloud()

let fullBookPath = fm.documentsDirectory() + "/thinking fast and slow - daniel kahneman.txt"


// File format:
// currentLineNumber\n   - integer, offset into full book
let inProgressPath = fullBookPath + ".inProgress.txt"


if (!fm.fileExists(inProgressPath)) {
  console.log("Creating in progress copy")
  fm.writeString(inProgressPath, "0\n")
}


let lines = fm.readString(fullBookPath).split("\n")
let lineOffset = 0

let fullBookLineCount = lines.length

const DEFAULT_APPROX_WORDS_PER_CHUNK = 600

let wordsPerChunk = DEFAULT_APPROX_WORDS_PER_CHUNK

let handsFreeMode = false

do {

  let progress = fm.readString(inProgressPath)
  if (!progress) {
    break
  } else {
    lineOffset = parseInt((progress.split("\n"))[0])
  }
  
  // Pick enough lines to have enough words
  
  let lineCount = findNumLinesToAchieveWordCount(lines, lineOffset, wordsPerChunk)
  
  console.log("Showing chunk of " + lineCount + " lines with " + (lines.length-lineCount) + " remaining")
  
  let chunkStr = stringForNumLines(lines, lineOffset, lineCount)
  
  // console.log(chunkStr)
  
  let action = "read"


  if (handsFreeMode) {
    let voiceCommand = await getDictatedText()
    
    let shouldStop = voiceCommand.match(/stop/i)
    if (shouldStop) {
      action = "stop"
    }
  } else {
    let actionAndWPC = await showWebViewWithText(chunkStr, lineOffset, fullBookLineCount, wordsPerChunk)
    
    action = actionAndWPC[0]
    wordsPerChunk = actionAndWPC[1]
  }
  
  if (action === "stop") {
    break
  }
  
  if (action === "start over") {
    let alert = new Alert()
    alert.title = "Start Over"
    alert.message = "Are you sure you want to forget all progress? This cannot be undone."
    alert.addDestructiveAction("Start Over")
    alert.addAction("Cancel")
    if (await alert.present() == 0) {
      console.log("Starting over!")
      fm.remove(inProgressPath)
    }
    
    break
  }
  
  if (action === "hands free") {
    action = "read"
    handsFreeMode = true
  }
  
  if (action === "read") {
    await speakText(chunkStr)
  }
  
  if (action === "previous") {
    lineOffset -= findNumLinesToGoBack(lines, lineOffset, wordsPerChunk)
  
    lineCount = 0
  }
  
  updateInProgressFile(lineOffset+lineCount, fullBookLineCount, inProgressPath)

} while (true)



function updateInProgressFile(newLineOffset, fullBookLineCount, inProgressPath) {
  if (newLineOffset >= fullBookLineCount) {
    console.log("No more lines remain!")
    fm.remove(inProgressPath)
    return
  }
  
  
  // Write to a temp file
  let tempFile = fm.documentsDirectory() + "/temp-book.txt"
  
  fm.writeString(tempFile, newLineOffset+"\n")
  
  console.log("Replacing " + inProgressPath)
  
  // Move the temp file to final path
  fm.remove(inProgressPath) // seems to be required since move errors if the destination file exists (contradicting the docs)
  fm.move(tempFile, inProgressPath)
}

async function showWebViewWithText(text, lineOffset, totalLineCount, wordsPerChunk) {
  let webView = new WebView()
  
  let html = "<html>"
  html += "<body>"
  
  html += `
  <script>
  document.body.style.zoom = 4.0
  </script>
  `
  
  html += "<center>"
  
  html += "<table>"
  
  html += "<tr>"
  html += "<td><input type='button' value='stop' onclick='setAction(\"stop\")'></td>"
  html += "<td><input type='button' value='skip' onclick='setAction(\"skip\")'></td>"
  html += "<td><input type='button' value='read' onclick='setAction(\"read\")'></td>"
  html += "<td><input type='button' value='hands free' onclick='setAction(\"hands free\")'></td>"
  html += "</tr>"
  
  html += "</table>"
  
  
  html += "<table>"
  html += "<tr>"
  
  html += "<td><input type='text' size='5' style='text-align:center;' id='desiredAction' value='read'></td>"
  html += "<td><input type='text' size='5' style='text-align:center;' id='wordsPerChunk' value='"+wordsPerChunk+"'> words</td>"
  
  html += "</tr>"
  html += "</table>"
  
  html += "<br />"
  
  let linesRead = lineOffset
  html += "Progress: " + linesRead + "/" + totalLineCount + " = " + (100*linesRead/totalLineCount).toFixed(1) + "%"
  
  html += "</center>"
  
  html += "<table>"
  
  let lines = text.split("\n")
  let count = 0
  for (line of lines) {
    html += "<tr>"

    html += "<td>"
    html += htmlEncode(line)
    html += "</td>"
    
    html += "</tr>"
    
    count++
  }
  
  html += "</table>"
  
  html += "<br /><br />"
  
  html += "<center>"
  html += "<table>"
  
  html += "<tr>"
  html += "<td><input type='button' value='previous' onclick='setAction(\"previous\")'></td>"
  html += "<td><input type='button' value='start over' onclick='setAction(\"start over\")'></td>"
  html += "</tr>"
  
  html += "</table>"
  html += "</center>"
  
  
  html += `
  <script>
  
  function setAction(str) {
    document.getElementById("desiredAction").value = str
  }
  
  function getDesiredAction() {
    let actionInput = document.getElementById("desiredAction")
    
    return actionInput.value
  }
  
  function getWordsPerChunk() {
    let wpcInput = document.getElementById("wordsPerChunk")
    
    return wpcInput.value
  }
  
  </script>
  `
  
  html += "</body></html>"
  
  await webView.loadHTML(html)
  await webView.present()
  
  let selectedAction = await webView.evaluateJavaScript("getDesiredAction()")
  console.log("action:\n" + selectedAction)
  
  let wpc = await webView.evaluateJavaScript("getWordsPerChunk()")
  console.log("wpc: " + wpc)
  
  return [selectedAction, wpc]
}



function stringForNumLines(lines, lineOffset, numLines) {
  let str = ""
  
  for (let i = 0; i < numLines; i++) {
    str += "\n" + lines[i+lineOffset];
  }
  
  return str
}


function findNumLinesToAchieveWordCount(lines, lineOffset, desiredWordCount) {
  let lineCount = 0
  
  let accumWC = 0
  
  for (let i = lineOffset; i < lines.length; i++) {
    
    let line = lines[i]
    let lineWC = line.split(" ").length
    
    // Don't far exceed word count
    if (i > 0 && lineWC > 2*desiredWordCount) {
      break
    }
    
    lineCount++
    accumWC += lineWC
    
    if (accumWC >= desiredWordCount) {
      break
    }
  }
  
  return lineCount
}


// Instead of making a custom reversed version of findNumLinesToAchieveWordCount, this is a more complex method that should work with any future implementation of that method
function findNumLinesToGoBack(lines, lineOffset, wordsPerChunk) {
  let numToGoBack = 0
  
  for (numToGoBack = 0; numToGoBack <= lineOffset; numToGoBack++) {
    let numLinesWeWouldPick = findNumLinesToAchieveWordCount(lines, lineOffset-numToGoBack, wordsPerChunk)
    
    // if our offset were lineOffset-numToGoBack
    // we would show numLinesWeWouldPick lines
    
    // if (lineOffset-numToGoBack) + numLinesWeWouldPick is equal to our current offset then that's the previous offset we had
    // if that sum is less than our current offset then it would be going back too far
    
    let testOffset = (lineOffset-numToGoBack) + numLinesWeWouldPick
    
    if (testOffset <= lineOffset) {
      break
    }
  }
  
  console.log("Going back by " + numToGoBack + " lines")
  
  return numToGoBack
}


// I call over to a shortcut because the Speech support in Scriptable doesn't let me configure the speaking speed
// https://www.icloud.com/shortcuts/da4c0a13f3a4435a8daf5bb4eb6b8c12
async function speakText(text) {
  let callbackURL = new CallbackURL("shortcuts://x-callback-url/run-shortcut")
  callbackURL.addParameter("name", "SpeakText")
  callbackURL.addParameter("input", "text")
  callbackURL.addParameter("text", text)
  console.log("callbackurl: " + callbackURL.getURL())
  
  let result = await callbackURL.open()
  console.log("speakText result: " + result)
}

// I call over to a shortcut because the Dictation support in Scriptable requires touch interaction
// https://www.icloud.com/shortcuts/daa622bd046f484caa9a133b9deed342
async function getDictatedText() {
  let callbackURL = new CallbackURL("shortcuts://x-callback-url/run-shortcut")
  callbackURL.addParameter("name", "Dictate")
  
  console.log("callbackurl: " + callbackURL.getURL())
  
  let result = await callbackURL.open()
  
  console.log("dictated text: " + result.result)
  
  return result.result
}


// HTML encoding utilities
// Main logic from https://ourcodeworld.com/articles/read/188/encode-and-decode-html-entities-using-pure-javascript

function htmlEncode(str) {
  var buf = [];
			
  for (var i=str.length-1;i>=0;i--) {
    buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
  }
			
  return buf.join('');
}

function htmlDecode(str) {
  return str.replace(/&#(\d+);/g, function(match, dec) {
    return String.fromCharCode(dec);
  });
}