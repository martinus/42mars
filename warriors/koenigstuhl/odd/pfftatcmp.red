;redcode
;author Paul khuong
;name pfft@cmp
;assert 1
;strategy scanner hehe (lose)

step	equ	7

bptr	dat.f	1,0
	dat.f	1,1
	dat.f	1,1
	dat.f	1,1
	dat.f	1,1
	dat.f	1,1
ptr	dat.f	0+step*3,0+step*4
inc	dat.f	step*2,	step*2
	mov	bmb,	}ptr
start	jmn.f	-1,	*ptr
	add.f	inc,	ptr
	jmz.f	start,	@ptr
	mov	bmb,	>ptr
	jmn.f	-2,	inc
bmb	spl	#0,	}0
	mov	2,	>bptr
	djn.f	-1,	>bptr
dbmb	dat.f	>2667,	-bptr+1
end start
