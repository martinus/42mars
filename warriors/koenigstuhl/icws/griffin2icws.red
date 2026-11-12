;redcode-icws
;name Griffin 2
;author Anders Ivner
;strategy small spl/jmp bombing cmp-scanner
;strategy coresize 8192 only
;assert CORESIZE==8192

boot	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	<spt,		<dpt
	mov	flip,		3000+flip-13
        mov     gate,           const+3000-76
spt	jmp	eyes+3000,	const+1
dpt     dat     #const+3000+1

gate	dat	<-21,		#0

flip    jmp     @4096,          4095

attack	mov	flip-13,	@eyes
dp	mov	bomb,		<eyes
	sub	flip-13,	@dp

eyes    cmp     bomb-76,        bomb-76+4096
	jmn	attack,		@dp
	add	const,		@dp
        djn     eyes,           #1023

bomb	spl	0,		<-20
const   mov     -76,            <-76

	end	boot
