;redcode
;name Astarion
;author koorogi
;strategy evolved
;created 2025.06.14
;assert CORESIZE == 80

	ORG	0

	SPL.BA	#59, >19
	SPL.BA	#30, >68
	MOV.I	#27, <35
	SPL.F	$29, {76
	JMN.A	>69, $8

	END
