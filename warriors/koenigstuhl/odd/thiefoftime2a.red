;redcode
;name Thief Of Time IIa
;author Darek L.
; <dtldarek@wp.pl>
;assert 1

  org GO
GO:	ADD.X   4,   5
	SLT.B   4,   CORESIZE-6
	ADD.X   2,   3
	MOV.I   2, @ 2
	JMP    -4, # 4	;GO
	JMP    -6,   1
  end
