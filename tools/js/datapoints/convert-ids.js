// convert_ids
// © Will Smart 2018. Licence: MIT

// This module allows string ids to be converted to and from the various data pointer types used by nobo
// The types include:
//
//  rowId : a pointer to a particular row in a db table.
//          Made up of a snake_case table name and the id value for the row joined by double underscores
//          eg. user__1
//
//  datapointId : a pointer to a particular field value in a db table.
//          Made up of a rowId and a snake_case field name, joined by double underscores
//          eg. user__1__name
//          Note that link values are also seen as datapoints.
//          So user__1__posts could well be an array of rowId's for posts
//
// PROXIES
//  proxyRowId : a proxy pointer to a particular row in a db table as understood by a particular client.
//          Made up of a snake_case table name and a snake_case proxy key joined by double underscores
//          eg. user__me
//          In the case of user__me, the proxy key 'me' could be mapped to the current user's id
//          If logged out, user__me could be made to redirect to some other row, like app__default
//
//  proxyDatapointId : a proxy pointer to a particular field value in a db table.
//          Made up of a proxyRowId and a snake_case field name, joined by double underscores
//          eg. user__me__name
//
// GENERAL
//  proxyableRowId : all rowId's and proxyRowId's are proxyableRowId's
//  proxyableDatapointId : all datapointId's and proxyDatapointId's are proxyableDatapointId's
//          This allows code to deal with both cases generally if need be
//

const specialFieldNames = {
    '?': 'existence',
  },
  typeNameRegex = /^([a-z0-9]+(?:_[a-z0-9]+)*)$/,
  dbRowIdRegex = /^([1-9][0-9]*)$/,
  fieldNameRegex = /^(\?|[a-z0-9]+(?:_[a-z0-9]+)*|)$/,
  // at some levels the system uses 'proxy' and 'proxyable' row ids
  // eg, when retrieving a model like 'user__me' the 'me' is a proxy row id
  proxyKeyRegex = /^([a-z][a-z0-9]*(?:_[a-z0-9]+)*)$/,
  // Pointer to a particular expression of a proxy to a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  proxyableRowIdRegex = new RegExp(
    `^(?:${dbRowIdRegex.source.substring(1, dbRowIdRegex.source.length - 1)}|${proxyKeyRegex.source.substring(
      1,
      proxyKeyRegex.source.length - 1
    )})$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [4]: field name in snake_case
  proxyDatapointRegex = new RegExp(
    `^${typeNameRegex.source.substring(1, typeNameRegex.source.length - 1)}__${proxyKeyRegex.source.substring(
      1,
      proxyKeyRegex.source.length - 1
    )}__~?${fieldNameRegex.source.substring(1, fieldNameRegex.source.length - 1)}$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  rowRegex = new RegExp(
    `^${typeNameRegex.source.substring(1, typeNameRegex.source.length - 1)}__${proxyableRowIdRegex.source.substring(
      1,
      proxyableRowIdRegex.source.length - 1
    )}$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [5]: field name in snake_case
  basicDatapointRegex = new RegExp(
    `^(${typeNameRegex.source.substring(1, typeNameRegex.source.length - 1)}__${proxyableRowIdRegex.source.substring(
      1,
      proxyableRowIdRegex.source.length - 1
    )})__~?${fieldNameRegex.source.substring(1, fieldNameRegex.source.length - 1)}$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [5]: field name in snake_case
  //      [6]: embedded datapoint id
  //      [7]: embedded datapoint: the row string
  //      [8]: embedded datapoint: typename in snake_case
  //      [9]: embedded datapoint: row id as an integer string
  //      [10]: embedded datapoint: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [11]: embedded datapoint: field name in snake_case
  datapointRegex = new RegExp(
    `^${basicDatapointRegex.source.substring(
      1,
      basicDatapointRegex.source.length - 1
    )}(?:\\[(${basicDatapointRegex.source.substring(1, basicDatapointRegex.source.length - 1)})\\])?$`
  );

// API
module.exports = {
  // deconstructs a string id into its component parts or throws if not possible
  // arguments object with one key of:
  //   rowId, datapointId
  decomposeId,

  // similar, but will return the supplied argument unchanged if it already has typeName defined
  ensureDecomposed,

  // reconstructs string ids from their component parts or throws if not possible
  recomposeId,

  // export the regexes as part of the public API
  typeNameRegex,
  dbRowIdRegex,
  fieldNameRegex,
  rowRegex,
  datapointRegex,
  proxyKeyRegex,
  proxyableRowIdRegex,
  proxyDatapointRegex,
};

const ChangeCase = require('change-case');

// deconstructs a string id into its component parts or throws if not possible
//  arguments object with one key of:
//    rowId, datapointId
function decomposeId({ rowId, datapointId, relaxed, permissive }) {
  if (datapointId) {
    const ret = stringToDatapoint(datapointId, permissive) || stringToDatapoint(datapointId, permissive);
    if (ret) return ret;
  }
  if (rowId) {
    const ret = stringToRow(rowId, permissive) || stringToRow(rowId, permissive);
    if (ret) return ret;
  }
  if (permissive) return;
  throw new Error('No id to decompose');
}

function ensureDecomposed({ typeName }) {
  return typeName === undefined ? decomposeId(arguments[0]) : arguments[0];
}

// reconstructs string ids from their component parts or throws if not possible
// you can provide more than one argument, in which case they are combined with the last taking precidence
function recomposeId({ typeName, dbRowId, proxyKey, fieldName, rowId, datapointId, embeddedDatapointId, permissive }) {
  if (arguments.length != 1) {
    const combined = {};
    Array.prototype.forEach.call(arguments, argument => processArg(argument, combined));
    return recomposeId(combined);
  } else {
    ({ typeName, dbRowId, proxyKey, fieldName, rowId, datapointId, embeddedDatapointId, permissive } = processArg(
      arguments[0]
    ));
  }

  function processArg(arg, into) {
    into = into || {};
    if (arg.rowId) {
      const args = decomposeId({ rowId: arg.rowId, permissive: true });
      if (args) {
        into.typeName = args.typeName;
        into.dbRowId = args.dbRowId;
        into.proxyKey = args.proxyKey;
      }
    }

    if (arg.datapointId) {
      const args = decomposeId({ datapointId: arg.datapointId, permissive: true });
      if (args) {
        into.typeName = args.typeName;
        into.dbRowId = args.dbRowId;
        into.proxyKey = args.proxyKey;
        into.fieldName = args.fieldName;
        into.embeddedDatapointId = args.embeddedDatapointId;
      }
    }

    Object.assign(into, arg);
    return into;
  }

  if (!typeName) {
    if (permissive) return;
    throw new Error("Can't recompose without typeName");
  }

  const ret = {
    typeName: ChangeCase.snakeCase(typeName),
  };
  if (!typeNameRegex.test(ret.typeName)) throw new Error('Type name has invalid characters or format');

  if (embeddedDatapointId !== undefined && !basicDatapointRegex.test(embeddedDatapointId))
    throw new Error('Embedded datapoint id has invalid format');

  if (dbRowId) {
    if (!dbRowIdRegex.test(dbRowId)) {
      throw new Error('Db row id has invalid characters or format');
    }
    ret.dbRowId = +dbRowId;
    ret.rowId = `${ret.typeName}__${ret.dbRowId}`;

    if (fieldName !== undefined) {
      ret.fieldName = specialFieldNames[fieldName] ? fieldName : ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error('Field name has invalid characters or format');

      ret.datapointId = `${ret.rowId}__${ret.fieldName}`;

      if (embeddedDatapointId) ret.datapointId += `[${embeddedDatapointId}]`;
    }
  } else if (proxyKey) {
    ret.proxyKey = proxyKey;
    if (!proxyKeyRegex.test(ret.proxyKey)) throw new Error('Proxy key has invalid characters or format');
    ret.rowId = `${ret.typeName}__${ret.proxyKey}`;

    if (fieldName !== undefined) {
      ret.fieldName = specialFieldNames[fieldName] ? fieldName : ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error('Field name has invalid characters or format');

      ret.datapointId = `${ret.rowId}__${ret.fieldName}`;

      if (embeddedDatapointId) ret.datapointId += `[${embeddedDatapointId}]`;
    }
  } else {
    if (permissive) return;
    throw new Error('Must have either a dbRowId or a proxyKey');
  }

  ret.typeName = ChangeCase.pascalCase(ret.typeName);
  if (ret.fieldName !== undefined && !specialFieldNames[fieldName]) ret.fieldName = ChangeCase.camelCase(ret.fieldName);

  return ret;
}

// Helper methods for applying the regexes

function stringToRow(rowId, permissive) {
  const match = rowRegex.exec(rowId);
  if (!match) {
    if (permissive) return;
    throw new Error(`Bad row id ${rowId}`);
  }

  return Object.assign(
    {
      rowId,
      typeName: ChangeCase.pascalCase(match[1]),
    },
    match[2]
      ? {
          dbRowIdOrProxyKey: match[2],
          dbRowId: +match[2],
        }
      : {
          dbRowIdOrProxyKey: match[3],
          proxyKey: match[3],
        }
  );
}

function stringToDatapoint(datapointId, permissive) {
  const match = datapointRegex.exec(datapointId);
  if (!match) {
    if (permissive) return;
    throw new Error(`Bad datapoint id ${datapointId}`);
  }

  return Object.assign(
    {
      datapointId,
      rowId: match[1],
      typeName: ChangeCase.pascalCase(match[2]),
      fieldName: specialFieldNames[match[5]] ? match[5] : ChangeCase.camelCase(match[5]),
      embeddedDatapointId: match[6],
    },
    match[3]
      ? {
          dbRowIdOrProxyKey: match[3],
          dbRowId: +match[3],
        }
      : {
          dbRowIdOrProxyKey: match[4],
          proxyKey: match[4],
        }
  );
}