require("chai").should();

const logger = require("leo-sdk/lib/logger")("connector.sql");
const PassThrough = require("stream").PassThrough;
const async = require("async");
const ls = require("leo-sdk").streams;

const mysqlLoader = require("../");

describe.only('SQL', function() {
	it('Should be able to stream changed IDs in and receive full objects out', function(done) {
		this.timeout(1000 * 10);
		let stream = new PassThrough({
			objectMode: true
		});

		let count = 0;
		const MAX = 24531;
		async.doWhilst((done) => {
			if (!stream.write({
					test: [++count, ++count, ++count]
				})) {
				stream.once('drain', done);
			} else {
				done();
			}
		}, () => count < MAX, (err) => {
			stream.end();
		});



		let transform = mysqlLoader({
			host: "localhost",
			user: "root",
			port: 3306,
			database: "datawarehouse",
			password: "a",
			connectionLimit: 10
		}, {
			test: true
		}, function(ids) {
			return {
				sql: `select * from test where id in (${ids.join()})`,
				id: "id",
				joins: {
					Customer: {
						type: 'one_to_many',
						on: "id",
						sql: `select * from test where id in (${ids.join()})`
					},
					Bob: {
						type: 'one_to_one',
						on: 'changed',
						sql: `select * from test where id in (${ids.join()})`,
						transform: row => {
							return {
								changed: row.id,
								combined: row.name + "-" + row.somethingelse
							};
						}
					}
				}
			};
		});
		ls.pipe(stream, transform, ls.log(), ls.devnull(), (err) => {
			console.log("all done");
			console.log(err);
			done(err);
		});
	});
});