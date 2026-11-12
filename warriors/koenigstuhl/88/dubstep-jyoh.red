;redcode
;name Dubstep A jyoh
;author Steve Gunnell
;strategy Infiltrator style jumping scanner
;strategy Fixing the terrible vulnerability found by John M ;)
;assert CORESIZE==8000

HOP	equ	(bomb+2-from)
LEN	equ	HOP+11
STEP	equ	3652
START	equ	2143
LEAP	equ	3457
from	mov	#LEN	,LEN
loop	add	#STEP	,ptr
	mov	bomb	,<ptr
ptr	jmz	loop	,@START
for 0
	add	#LEAP	,pptr
rof
for 1
	mov	bomb2	,<ptr
rof
copy	mov	<from	,<pptr
for 0
	mov	<from	,<pptr
rof
	jmn	copy-1	,from
	spl	from	,<-START
pptr	jmz	@0	,LEAP
for 1
bomb2	dat	<2667	,<5334
rof
bomb	dat	<2667	,<0-HOP

	end     from

