;redcode-94x
;name Pagan
;author John K W
;assert CORESIZE==55440

dist 	equ 17 ;83 ;17 ;34 ;214 ;147 ;246 ;73 ;98
scan 	equ dist*2

org boot
     
for 21
spl.i  0, 0
spl.ab 0, #0
spl.x #0, 0
spl.f #0, #0
rof

bootptr dat     off+1,  2000
boot    mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        mov     {bootptr,       <bootptr
        jmp     @bootptr

     	add 	off,	@x
loc  	cmp.f   dist-1, -1
     	slt 	#14,    @x
loop    djn.f   -3,     <-(998)
     	mov     s,      >loc
x    	mov     j,      @loc
        add 	new,	@x
     	jmn 	loc,    loc-1
s    	spl 	#0,	0
     	mov     2,      >loc-3
j       jmp     -1
new  	dat 	<dist,  <dist-1
off  	dat 	<scan,	<scan

for 20
spl.i  0, 0
spl.ab 0, #0
spl.x #0, 0
spl.f #0, #0
rof

