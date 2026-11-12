;redcode-94m
;name Multi Kulti
;author Christian Schmidt
;strategy two paper-launching imp spirals (Terkonit 0.4)
;assert 1

pst1	equ	2200
pst2	equ	3740
pst3	equ	3044
bst1	equ	1870
bst2	equ	2340
bdist 	equ	500
ist	equ	2667




	spl	ipa

ip	spl	1,	<-1000		;generates 8 parallel processes
	spl	1,	<-2000
	spl	1,	<-7000

m1	mov	{bptr1,	<bptr1		;now boot the paper
m2	mov	{bptr2,	<bptr2		;to 3 different locations
m3	mov	{bptr3,	<bptr3		;impstep away from each other

	spl	g3,	<-3000		;OK, they are copied,
	spl	g2,	<-4000		;now starting them with a
g1	jmp	@bptr1,	<-5998		;binary launcher
g2	jmp	@bptr2,	<-5999
g3	mov	ip,	@-6000
	spl	@bptr3

s1	spl	@s1, 	}pst1		;first paper cell
	mov.i	}s1, 	>s1
s2	spl	@s2, 	}pst2		;second paper cell
	mov.i	}s2, 	>s2
	mov.i	{-bst1,	<bst1		;bombing a bite
s3	spl	@s3, 	}pst3		;third paper cell
	mov.i	}s3, 	>s3
imp	mov.i	#ist, 	*0		;and the imp

bptr1	dat	imp+1,	imp+1+bdist		;here are the
bptr2	dat	imp+1,	imp+1+bdist+ist		;boot pointer
bptr3	dat	imp+1,	imp+1+bdist+2*ist

space	for	50
	dat	0, 0
	rof

ipa	spl	1,	<-1000		;generates 8 parallel processes
	spl	1,	<-2000
	spl	1,	<-7000

m1a	mov	{bptr1a,	<bptr1a		;now boot the paper
m2a	mov	{bptr2a,	<bptr2a		;to 3 different locations
m3a	mov	{bptr3a,	<bptr3a		;impstep away from each other

	spl	g3a,	<-3000		;OK, they are copied,
	spl	g2a,	<-4000		;now starting them with a
g1a	jmp	@bptr1a,<-5998		;binary launcher
g2a	jmp	@bptr2a,<-5999
g3a	mov	ipa,	@-6000
	spl	@bptr3a

s1a	spl	@s1a, 	}pst1		;first paper cell
	mov.i	}s1a, 	>s1a
s2a	spl	@s2a, 	}pst2		;second paper cell
	mov.i	}s2a, 	>s2a
	mov.i	{-bst1,	<bst1		;bombing a bite
s3a	spl	@s3a, 	}pst3		;third paper cell
	mov.i	}s3a, 	>s3a
impa	mov.i	#ist, 	*0			;and the imp

bptr1a	dat	impa+1,	impa+1+bdist		;here are the
bptr2a	dat	impa+1,	impa+1+bdist+ist		;boot pointer
bptr3a	dat	impa+1,	impa+1+bdist+2*ist

