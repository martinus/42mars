;redcode-IRCT
;name Dwayne
;author Sascha Zapf
;assert CORESIZE==8000 
;       MAXPROCESSES==8
;strategy imp-throwing bomber

dwarf	mov.i	imp,*imp
		add.a	#3044, imp
		jmp		dwarf, <-10
imp		mov.i	#0,1

start

one		mov.i	imp,	<500
		mov.i	imp-1, <one
		mov.i	imp-2, <one
		mov.i	imp-3, <one
		spl		@one

two		mov.i	imp,	<1500
		mov.i	imp-1, <two
		mov.i	imp-2, <two
		mov.i	imp-3, <two
		spl		@two

three		mov.i	imp,	<2500
		mov.i	imp-1, <three
		mov.i	imp-2, <three
		mov.i	imp-3, <three
		jmp		@three

		end start
