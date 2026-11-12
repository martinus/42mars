;redcode
;name Thief Of Time I
;author Darek L.
; <dtldarek@wp.pl>
;assert CORESIZE % 10 == 0

  org GO
	DAT   #  10, # -10
	JMP     -5,    6	;GO
GO:	ADD.F   -2,   -1
	MOV.I   -2, @ -2
	ADD.F   -4,   -3
	MOV.I   -5, @ -4
	JMP	-4, #  0	;GO
  end
