;redcode-nano verbose
;name Yersinia pestis
;author Fluffy
;strategy The Black Death returns ...
;assert CORESIZE == 80

	ORG	start

start	spl.b  # 50, > 56
	mov.i  > 13, { 71
	mov.i  > 78, { 53
	mov.i  > 31, { 27
	djn.x  $ 78, { 37

	END
