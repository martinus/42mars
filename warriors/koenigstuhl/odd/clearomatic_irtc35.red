;redcode
;name Clear-o-matic
;author Sascha Zapf
;assert 1

start	mov.i	{ptr1,<ptr1
        djn.b	start, #5
        spl		@ptr1
pGo		spl	#0
		mov.i	bomb,<ptr
        djn.b	pGo,<ptr
bomb	dat		-10,-10
ptr		dat		-10,-10

ptr1	dat pGo+5,pGo+225

     end start