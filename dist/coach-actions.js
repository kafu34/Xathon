/* The same intent guard runs in the browser and the AI endpoint. */
((root)=>{
  const action=/\b(add|create|book|put|insert|change[ds]?|move[ds]?|reschedul\w*|updat\w*|cancel\w*|remove|delete)\b/i;
  root.PaceIntent={
    isScheduleRequest(text){return (action.test(text)||/\b(?:schedule|shift)\s+(?:(?:me|a|an|the|my)\s+)?(?:lab|class|exam|meeting|appointment|session|workout|walk|event)\b/i.test(text))&&/\b(class|lecture|lab|tutorial|exam|meeting|shift|event|session|workout|walk|timetable|schedule|calendar|appointment|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b|\b\d{4}-\d{2}-\d{2}\b/i.test(text);},
    claimsMutation(text){return /\b(?:i(?:['’]ve| have)?|we(?:['’]ve| have)?)\s+(?:(?:now|successfully|already|just)\s+)?(?:added|scheduled|saved|updated|moved|changed|booked|removed|cancelled|deleted)\b|\b(?:is|has been|was|are|have been)\s+(?:(?:now|successfully|already)\s+)?(?:scheduled|added|saved|updated|moved|changed|booked|removed|cancelled|deleted)\b|\b(?:added|scheduled|saved|updated|moved|booked)\s+(?:your|the)\b/i.test(text);}
  };
})(typeof window==='undefined'?globalThis:window);
