test:
	yarn -s run eslint --color .
	yarn -s run jest --color

unittest:
	yarn -s run jest --color --watchAll=true

coverage:
	yarn -s run jest --collectCoverage --coverageReporters text

publish:
	git push -u --tags origin master
	npm publish

deps:
	yarn

update:
	yarn -s run updates -u
	rm -rf node_modules
	$(MAKE) deps

patch: test
	yarn -s run versions -C patch
	$(MAKE) publish

minor: test
	yarn -s run versions -C minor
	$(MAKE) publish

major: test
	yarn -s run versions -C major
	$(MAKE) publish

.PHONY: test unittest coverage publish deps update patch minor major
