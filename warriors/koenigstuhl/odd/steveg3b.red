;redcode
;name HazyLazy 2022GM phch
;author Steve Gunnell
;strategy qscan -> SEQ scan with inline bomb
;strategy Went back to rejig Blur2 & The Machine
;assert 1

top:	mov.i	inc	,>-3
scan:	seq.i	-6	,-4
	mov.b	scan	,@top
a:	sub.f	inc	,scan
	jmn.b	top	,@top
inc:	spl.i	#4	,>4
	mov.i	clr	,>top
btm:	djn.f	-1	,>top
clr:	dat	}0	,6

for 47
	dat	0	,0
rof

setup	mul.ab	#-8	,#7
	mul.a	#6	,-1
	add.f	setup	,1
	mul.ab	#7	,#8
	mov.ba	-1	,*setup
	add.ab	#8	,*setup
	sub.ab	#8	,>setup
	mul.f	V0	,@setup
p1	add.b	setup	,#-4
	mul.f	V0	,@p1
	sub.ab	#5	,p1
	spl	@p1	,1
	mov.i	V0+1	,p1
	jmn.f	-1	,<-1
V0	dat	5	,5


	end	setup

