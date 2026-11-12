;redcode
;name Tiny One-Shot
;author Paul Khuong
;email: fizmo_master@yahoo.com
;strategy gnnn :p
;assert 1

step	equ	304

ptr	dat.f	0+step+1,0+step*2+1
inc	dat.f	step*2+1,step*2+1
a	add	inc,	ptr
start	jmn.f	sb,	<ptr
	jmz.f	a,	{ptr
	mov.x	ptr,	ptr
sb	spl	#-1,	bptr-ptr
	mov	*bptr,	>ptr
	mov	*bptr,	>ptr
	djn.f	-2,	{ptr-1
db	dat.f	sb-bptr,bptr-ptr
bptr	dat.f	sb,	0
	end	start
