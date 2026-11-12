;redcode
;name Faster Hack'em
;author Sascha Zapf
;2nd Entry for the 4th IRC-Mini-Tournament on Sunday 2003-03-30
;strategy djn-stream throwing stone without { } < >
;assert 1

start	mov.i	prekiller,*pos
	mov.i	killer,@pos
	spl	@pos
	add.f	inkr,pos
	jmp	start
pos	dat	328,329
inkr	dat	328,328
prekiller	add.ab	#-1,#1
killer		djn	prekiller,-10
	end start
