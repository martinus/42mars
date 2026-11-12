;name Not so elusive
;author Simon Duff
;strategy Just a multipass CoreClear
;assert 1

		ORG start

; my core clear code
cptr:	dat	#2,	#108 ; value should be a likely spot the enemy will be
top:	dat	#1,	#8
start:	spl	#1,	#8
		mov	*cptr,>cptr
		mov	*cptr,>cptr
		jmp   -2, 	>(cptr-5)

