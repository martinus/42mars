;redcode-94x
;name Heimdal XB 31
;author Steve Gunnell
;strategy .66C scan and directed wipe
;assert CORESIZE==55440

STEP   	equ 40567
GAP		equ	11
SAFE	equ	(bomb-scan+2+8)
HOP		equ	(SAFE+GAP)
START	equ	50575
IMPNUM 	equ	21029
COUNT	equ	37932

sGo		add.f	inc,	scan
scan	seq.i	START,	START+GAP
		slt.ab	#SAFE,	scan
		jmp		sGo,	0
		spl		clear,	0
		jmp		sGo,	0
clear	mov.b	scan,	scan-GAP
wipe	mov.i	bomb,	>scan-GAP
	for 0
		mov.i	*wipe,	@wipe
	rof
		djn		wipe,	#COUNT
		jmp		wipe,	}wipe
inc		dat		#STEP,	#STEP
bomb	spl #0, HOP
		mod.x {0, HOP

end    scan

