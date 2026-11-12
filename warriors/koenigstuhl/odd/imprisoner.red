;redcode
;name IMPrisoner
;author Jakub Kozisek
;assert 1


      istep     equ     267

start spl 	1,	<201
      spl 	1,	{500
      spl 	2,	<312
      jmp 	@0,	imp
      add.ab	#istep,  -1
imp   mov.i 	#istep, *0

