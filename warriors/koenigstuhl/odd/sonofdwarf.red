;redcode-irct
;name Son of Dwarf
;author Sascha Zapf
;assert 1
; -s 800 -p 800 -c 8000 -l 8 -d 8
; Kein > und } f’r mov.i, keine djn-instruktion.

start	mov.i	bomb,@bomb
		add.ab	#215,bomb
		nop		<0,	<-50
		jmp		start
bomb	dat.f	0,0

		end start
