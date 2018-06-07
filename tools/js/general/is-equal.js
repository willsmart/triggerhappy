// compare
// © Will Smart 2018. Licence: MIT

// This is a simple testing rig


// API is the multi-function isEqual function
module.exports = isEqual

function description(value) {
  try {
    return JSON.stringify(value)
  } catch (err) {
    return `${value}`
  }
}

// isEqual(v1,v2,options) -- return as a boolean whether v1 and v2 are the same
//    v1: any value
//    v2: any value
//    options: optional object with options
//        options.verboseFail: if the call fails, give a detailed reason as a string
//        options.unordered: when comparing arrays, disregard their order
//        options.allowSuperset: if v1 is not equal to v2, but v1 includes v2, return '>'
//        options.exact: disallow type coersion
//    returns a boolean, or '>', or a longer string if it would return false and options.verboseFail is set
//
function isEqual(v1, v2, options = {}) {
  const {
    verboseFail,
    allowSuperset,
    exact
  } = options

  if (typeof (v1) != typeof (v2) || Array.isArray(v1) != Array.isArray(v2)) {
    if (exact) {
      return (verboseFail ? `Types differ: ${description(v1)} vs ${description(v2)}` : false)
    }
    if (v1 === true ? v2 : (v1 === false ? !v2 : (v2 === true ? v1 : (v2 === false ? !v1 : (v1 == v2))))) {
      return true
    }
    return (verboseFail ? `Values are not equal: ${description(v1)} vs ${description(v2)}` : false)
  }

  if (typeof (v1) == 'number' || typeof (v1) == 'boolean' || typeof (v1) == 'string') {
    return v1 == v2 ? true :
      (verboseFail ? `${typeof (v1)}s differ: ${description(v1)} vs ${description(v2)}` : false)
  }

  if (Array.isArray(v1)) {
    return allowSuperset ? arrayIsEqualOrSuperset(v1, v2, options) : arrayIsEqual(v1, v2, options)
  }

  if (typeof (v1) == 'object') {
    return allowSuperset ? objectIsEqualOrSuperset(v1, v2, options) : objectIsEqual(v1, v2, options)
  }

  return v1 === v2 ? true :
    (verboseFail ? `${typeof (v1)}s differ: ${description(v1)} vs ${description(v2)}` : false)
}


function arrayIsEqual(v1, v2, options) {
  const {
    verboseFail,
    unordered,
    exact
  } = options

  if (v1.length != v2.length) {
    return (verboseFail ? `Array lengths differ: ${description(v1)} vs ${description(v2)}` : false)
  }
  if (!v1.length) return true;

  if (!unordered) {
    let index = 0
    for (const c1 of v1) {
      const res = isEqual(c1, v2[index], options)
      if (res !== true) {
        return (verboseFail ? `${res}\n > Array values at index ${index} differ: ${description(v1)} vs ${description(v2)}` : false)
      }
      index++
    }
  } else {
    const unusedC1Indexes = Object.assign({}, v1.map(() => true))
    for (const c2 of v2) {
      let found = false
      for (const c1Index in unusedC1Indexes)
        if (unusedC1Indexes.hasOwnProperty(c1Index)) {
          const c1 = v1[c1Index]
          if (isEqual(c1, c2, {
              unordered,
              exact
            })) {
            delete unusedC1Indexes[c1Index]
            found = true
            break;
          }
        }
      if (!found) {
        return (verboseFail ? `Value ${description(c2)} from the second array was not found in the first: ${description(v1)} vs ${description(v2)}` : false)
      }
    }
  }
  return true
}

function objectIsEqual(v1, v2, options) {
  const {
    verboseFail,
  } = options

  const v1Keys = Object.keys(v1),
    v2Keys = Object.keys(v2)
  if (v1Keys.length != v2Keys.length) {
    return (verboseFail ? `Object sizes differ: ${description(v1)} vs ${description(v2)}` : false)
  }
  for (const v1Key of v1Keys) {
    const res = isEqual(v1[v1Key], v2[v1Key], options)
    if (res !== true) {
      return (verboseFail ? `${res}\n > Values for key ${v1Key} differ: ${description(v1)} vs ${description(v2)}` : false)
    }
  }
  return true
}

function arrayIsEqualOrSuperset(v1, v2, options) {
  const {
    unordered,
    exact,
    verboseFail
  } = options

  if (v1.length < v2.length) return (verboseFail ? `First array is smaller than second: ${description(v1)} vs ${description(v2)}` : false);
  if (!v1.length) return true;

  let supersetMatch = v1.length > v2.length

  if (!unordered) {
    let index = 0
    for (const c2 of v2) {
      const res = isEqual(v1[index], c2, options)
      if (res == '>') supersetMatch = true;
      else if (res !== true) return (verboseFail ? `${res}\n > Array values at index ${index} differ: ${description(v1)} vs ${description(v2)}` : false)
      index++
    }
    return supersetMatch ? '>' : true
  } else {
    const unusedC1Indexes = Object.assign({}, v1.map(() => true))
    const unusedC2Indexes = {}
    let c2Index = 0
    for (const c2 of v2) {
      let found = false
      for (const c1Index in unusedC1Indexes) {
        if (unusedC1Indexes.hasOwnProperty(c1Index)) {
          const c1 = v1[c1Index]
          if (isEqual(c1, c2, {
              unordered,
              exact
            })) {
            delete unusedC1Indexes[c1Index]
            found = true
            break;
          }
        }
      }
      if (!found) unusedC2Indexes[c2Index] = []
      c2Index++
    }
    if (!Object.keys(unusedC1Indexes).length) return true

    for (const [c2Index, supersetsC1Indexes] of Object.entries(unusedC2Indexes)) {
      for (const c1Index of Object.keys(unusedC1Indexes)) {
        if (isEqual(v1[c1Index], v2[c2Index], {
            unordered,
            exact,
            allowSuperset: true
          })) {
          supersetsC1Indexes.push(c1Index)
        }
      }
      if (!supersetsC1Indexes.length) return (verboseFail ? `Member ${description(v2[c2Index])} of second array has no equivalent superset in the first, or all such supersets are already matched with an exact match in the second array: ${description(v1)} vs ${description(v2)}` : false)
    }
    const c2IndexesInOrder = Object.keys(unusedC2Indexes).sort((a, b) => Object.keys(unusedC2Indexes[a]).length - Object.keys(unusedC2Indexes[b]).length)

    function findMapping(c2IndexIndex) {
      if (c2IndexIndex == c2IndexesInOrder.length) return true
      const c2Index = c2IndexesInOrder[c2IndexIndex]
      const supersetsC1Indexes = unusedC2Indexes[c2Index]
      for (const c1Index of supersetsC1Indexes) {
        if (unusedC1Indexes[c1Index]) {
          delete unusedC1Indexes[c1Index]
          if (findMapping(c2IndexIndex)) return true
          unusedC1Indexes[c1Index] = true
        }
      }
    }

    return findMapping(0) ? '>' : false
  }
}

function objectIsEqualOrSuperset(v1, v2, options) {
  const {
    verboseFail
  } = options

  const v1Keys = Object.keys(v1),
    v2Keys = Object.keys(v2)
  if (v1Keys.length < v2Keys.length) return (verboseFail ? `First object has fewer keys than second: ${description(v1)} vs ${description(v2)}` : false);
  let supersetMatch = v1Keys.length > v2Keys.length
  for (const v2Key of v2Keys) {
    const res = isEqual(v1[v2Key], v2[v2Key], options)
    if (res == '>') supersetMatch = true
    else if (res !== true) return (verboseFail ? `${res}\n > Values for key ${v2Key} are not equal or superset/subset: ${description(v1)} vs ${description(v2)}` : false)
  }
  return supersetMatch ? '>' : true
}