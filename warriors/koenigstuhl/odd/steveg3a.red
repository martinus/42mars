;redcode
;name Acriflavine 2022GM mjtk
;author Steve Gunnell
;strategy Oneshot
;assert 1

	dat	8	,8
	add	-1	,gate
	sne	@gate	,*gate
	add	-3	,gate
scn	sne	@gate	,*gate
	djn.f	-4	,<-2
	jmp	clr	,<gate

	dat	0	,0

gate	dat	7	,-8

	dat	0	,0

	dat	#-2	,bot-gate-5
clr	spl	#-2	,bot-gate-5
bom	mov	@bot	,>gate
	mov	@bot	,>gate
	mov	@bot	,>gate
bot	djn.f	bom	,{clr

for 42
	dat	0	,0
rof

a1	dat	-8	,8
setup	mul.ab	#-8	,#8
	mul.a	#6	,-1
	add.f	a1	,*setup
	add.f	a1	,{setup
	add.f	setup	,1
V1	mul.ab	#2	,#6
	add.x	V1	,V1
p2	add.b	setup	,#-2
	mov.f	V1	,>p2
	spl	@p2	,0
	add.ab	#4	,p2
	mul.b	V1	,@p2
	sub	p2	,p2

end	setup

