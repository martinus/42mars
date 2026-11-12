;redcode-94
;name no backup
;author elkauka
;assert 1

step	equ	4070
hop	equ	2769
dist	equ	4

gate	equ	(inc-dist)
hit	equ	(off-step-hop)
pre	equ	(inc-step)

inc	spl	#step,	{-step
ptr	mov.i	{step,	{hit
	mov.i	bomb,	@ptr
	mov.i	bomb,	{pre
	add.f	inc,	ptr
loop	djn.f	ptr,	{pre
	mov.i	bomb,	>gate
off	djn.f	loop,	>gate
bomb	dat	>hop,	}(dist+10)

end

