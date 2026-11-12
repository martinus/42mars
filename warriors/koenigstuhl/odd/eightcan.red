;redcode-irct
;name 8can
;author Sascha Zapf
;assert 1
;       CORESIZE==800
; Kein > und } f’r mov.i, keine djn-instruktion.

loop	sub.ab #312,scan
scan		jmz.f	loop, loop-1-312
		mov.b	scan,pos
		spl	#0,#0
		mov.i	bomb,<pos
		jmp -2
bomb	dat.f	0,-10
pos		dat.f	0,0
		end loop
