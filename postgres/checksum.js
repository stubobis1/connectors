"use strict";
var aws = require("aws-sdk");
const connect = require("./lib/connect.js");
// require("leo-sdk/lib/logger").configure(/.*/, {
// 	all: true
// });

module.exports = function(config) {
	let client = connect(config);
	console.log(client);

	return {
		init: function(obj, callback) {
			if (!obj.sql) {
				obj.sql = `select ${obj.fields.join(', ')}
				from "${obj.tableName}"
				WHERE ${obj.id_column} __IDCOLUMNLIMIT__
				`;
			}
			client.query(`${obj.sql.replace('__IDCOLUMNLIMIT__', ' between 1 and 0')} LIMIT 0`, (err, results, fields) => {
				let rFields = [];
				console.log(fields);
				fields.forEach((f, i) => {
					let field = {
						column: obj.fields ? obj.fields[i] : f.name,
						type_id: f.dataTypeID,
						type: types[f.dataTypeID]
					};
					if (field.type.match(/date/) || field.type.match(/time/)) {
						field.sql = `coalesce(md5(floor(extract(epoch from ${field.column}))::text), ' ')`;
					} else {
						field.sql = `coalesce(md5((${field.column})::text), ' ')`;
					}
					rFields.push(field);
				});
				callback(null, {
					fields: rFields,
					tableName: obj.table_name || obj.tableName,
					idColumn: obj.id_column || obj.idColumn,
					sql: obj.sql
				});
			});
		},
		destroy: function() {
			client.end();
		},
		escape: function(val) {

		},
		batch: (session, data, callback) => {
			client.query(`select count(*) as count,
						sum(('x' || substring(hash, 1, 8))::bit(32)::bigint) as sum1,
						sum(('x' || substring(hash, 9, 8))::bit(32)::bigint) as sum2,
						sum(('x' || substring(hash, 17, 8))::bit(32)::bigint) as sum3,
						sum(('x' || substring(hash, 25, 8))::bit(32)::bigint) as sum4
					FROM (
				        select md5(${session.fields.map(f=>f.sql).join(' || ')}) as "hash"
						from (
							${session.sql.replace('__IDCOLUMNLIMIT__', " between 0 and 1000")} 
						 ) i 
				) as t`, callback);
		},
		individual: (session, data, callback) => {
			client.query(`select "${session.idColumn}" as id, md5(${session.fields.map(f=>f.sql).join(' || ')}) as "hash"
						  from (
								${session.sql.replace('__IDCOLUMNLIMIT__', " between 0 and 1000")} 
						   ) i `, callback);
		},
		sample: (session, data, callback) => {
			client.query(`select "${session.idColumn}" as id, ${session.fields.map(f=>f.column).join(',')}
							from (
							    ${session.sql.replace('__IDCOLUMNLIMIT__', " = ANY($1::int[])")} 
						    ) i 
							`, [data.ids], callback);
		},
		range: (session, data, callback) => {
			let where = [];
			if (data.min) {
				where.push(`"${idColumn}" >= ${escape(data.min)}`);
			}
			if (data.max) {
				where.push(`"${idColumn}" <= ${escape(data.max)}`);
			}
			var whereStatement = "";
			if (where.length) {
				whereStatement = ` where ${where.join(" and ")} `;
			}
			client.query(`select MIN("${session.idColumn}") as min, MAX("${session.idColumn}") as max, count("${session.idColumn}")::int total from "${session.tableName}" ${whereStatement}`, callback);
		},
		nibble: (session, data, callback) => {
			let where = [];
			if (data.start) {
				where.push(`"${session.idColumn}" >= ${escape(data.start)}`);
			}
			if (session.max) {
				where.push(`"${session.idColumn}" <= ${escape(session.max)}`);
			}
			var whereStatement = "";
			if (where.length) {
				whereStatement = ` where ${where.join(" and ")} `;
			}
			client.query(`select "${session.idColumn}" from "${session.tableName}" ${whereStatement} 
				ORDER BY ${session.idColumn} ${session.reverse?'desc':'asc'}
				LIMIT 2 OFFSET ${data.limit-1}`, callback);
		}
	};
};
let types = {
	16: 'bool',
	17: 'bytea',
	18: 'char',
	19: 'name',
	20: 'int8',
	21: 'int2',
	22: 'int2vector',
	23: 'int4',
	24: 'regproc',
	25: 'text',
	26: 'oid',
	27: 'tid',
	28: 'xid',
	29: 'cid',
	30: 'oidvector',
	71: 'pg_type',
	75: 'pg_attribute',
	81: 'pg_proc',
	83: 'pg_class',
	114: 'json',
	142: 'xml',
	143: '_xml',
	199: '_json',
	194: 'pg_node_tree',
	32: 'pg_ddl_command',
	210: 'smgr',
	600: 'point',
	601: 'lseg',
	602: 'path',
	603: 'box',
	604: 'polygon',
	628: 'line',
	629: '_line',
	700: 'float4',
	701: 'float8',
	702: 'abstime',
	703: 'reltime',
	704: 'tinterval',
	705: 'unknown',
	718: 'circle',
	719: '_circle',
	790: 'money',
	791: '_money',
	829: 'macaddr',
	869: 'inet',
	650: 'cidr',
	1000: '_bool',
	1001: '_bytea',
	1002: '_char',
	1003: '_name',
	1005: '_int2',
	1006: '_int2vector',
	1007: '_int4',
	1008: '_regproc',
	1009: '_text',
	1028: '_oid',
	1010: '_tid',
	1011: '_xid',
	1012: '_cid',
	1013: '_oidvector',
	1014: '_bpchar',
	1015: '_varchar',
	1016: '_int8',
	1017: '_point',
	1018: '_lseg',
	1019: '_path',
	1020: '_box',
	1021: '_float4',
	1022: '_float8',
	1023: '_abstime',
	1024: '_reltime',
	1025: '_tinterval',
	1027: '_polygon',
	1033: 'aclitem',
	1034: '_aclitem',
	1040: '_macaddr',
	1041: '_inet',
	651: '_cidr',
	1263: '_cstring',
	1042: 'bpchar',
	1043: 'varchar',
	1082: 'date',
	1083: 'time',
	1114: 'timestamp',
	1115: '_timestamp',
	1182: '_date',
	1183: '_time',
	1184: 'timestamptz',
	1185: '_timestamptz',
	1186: 'interval',
	1187: '_interval',
	1231: '_numeric',
	1266: 'timetz',
	1270: '_timetz',
	1560: 'bit',
	1561: '_bit',
	1562: 'varbit',
	1563: '_varbit',
	1700: 'numeric',
	1790: 'refcursor',
	2201: '_refcursor',
	2202: 'regprocedure',
	2203: 'regoper',
	2204: 'regoperator',
	2205: 'regclass',
	2206: 'regtype',
	4096: 'regrole',
	4089: 'regnamespace',
	2207: '_regprocedure',
	2208: '_regoper',
	2209: '_regoperator',
	2210: '_regclass',
	2211: '_regtype',
	4097: '_regrole',
	4090: '_regnamespace',
	2950: 'uuid',
	2951: '_uuid',
	3220: 'pg_lsn',
	3221: '_pg_lsn',
	3614: 'tsvector',
	3642: 'gtsvector',
	3615: 'tsquery',
	3734: 'regconfig',
	3769: 'regdictionary',
	3643: '_tsvector',
	3644: '_gtsvector',
	3645: '_tsquery',
	3735: '_regconfig',
	3770: '_regdictionary',
	3802: 'jsonb',
	3807: '_jsonb',
	2970: 'txid_snapshot',
	2949: '_txid_snapshot',
	3904: 'int4range',
	3905: '_int4range',
	3906: 'numrange',
	3907: '_numrange',
	3908: 'tsrange',
	3909: '_tsrange',
	3910: 'tstzrange',
	3911: '_tstzrange',
	3912: 'daterange',
	3913: '_daterange',
	3926: 'int8range',
	3927: '_int8range',
	2249: 'record',
	2287: '_record',
	2275: 'cstring',
	2276: 'any',
	2277: 'anyarray',
	2278: 'void',
	2279: 'trigger',
	3838: 'event_trigger',
	2280: 'language_handler',
	2281: 'internal',
	2282: 'opaque',
	2283: 'anyelement',
	2776: 'anynonarray',
	3500: 'anyenum',
	3115: 'fdw_handler',
	325: 'index_am_handler',
	3310: 'tsm_handler',
	3831: 'anyrange'
};