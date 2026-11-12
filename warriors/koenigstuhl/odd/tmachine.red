;redcode-94t quiet
;name The T Machine
;author Zul Nadzri
;strategy My smartbomb/combatra warrior still buggy.
;strategy So, I have to satisfy with straight forward warrior.
;strategy May be can't successfully defeat others.
;strategy Hopefully its SureWin & slave will balance the losses.
;strategy Jan 2004
;       CORESIZE==8192
;assert 1

PIN 3

;------ Okay, I confess. I love the machine! ----
step EQU 72
gate EQU top
away EQU clr+1995

      mov.i  bomb-top,>-1
FOR 3
      dat 0,0
ROF
ptr:  mov.i  inc+1,>3314
top:  mov.i  bomb,>ptr          
scan: seq.i  2*step,2*step+5 
      mov.ab scan,@top
a:    sub.f  inc,scan
      jmn.b  top,@top
inc:  spl.i  #-step,>-step
      mov.i  clr,>gate
btm:  djn.f  -1,>gate
clr:  dat.f  <2731,clr-gate+2
      dat 0,0
      spl.i  #-step,>-step
      dat 0,0
bomb: spl.i  #1,#1
      dat 0,0
      dat 0,0
      mov.i  {-3,<6
      dat 0,0
boot: mov.i  clr,<dest
FOR 8
      mov.i  {boot,<dest
ROF
dest: mov.i  bomb,*away
out2  spl @dest,{-1001
dx    jmp pat, }-2750
      dat <dest,<dest
      mov.i  {-8,<1
      spl.a  #1,*1
pat   mov.i  {boot,<dest
      mov.i btm, bomb
	mov.i zero, out1
	mov.i pat, out2
	mov.i out4, out3
	mov.i clr, a
	mov.i out5+5, out5
	mov.i dest-2, dest-7
      dat >499, >1701
;      spl.i  #1,#1

FOR 12+40-6-1
      spl.a  #1,*1
      spl.b  #1,1
      spl.ab #1,@1
      spl.ba #1,}1
      spl.i  #1,#1
ROF
FOR 4      
      spl.i  #1,#1
ROF

;---- This is SureWin Technology ---------------
win	stp #30, #3
pat3	nop 0,0
	stp #39, #3
	jmp boot

start	ldp #0, #0	
out3	sne.ab #-1, -1
	jmp x1		
test	ldp #3, #0		
	seq.ab #30, -1	
	jmp boot, }4378	
out4	stp #39, #3		
	ldp #1, #0		
	seq.ab #10, -1	
out1	jmp boot, >4000
	seq.ab #0, start	
	jmp win, >3500
x3	stp #10, #1		
	nop 0,0
zero	dat 0
x1	stp #30, #3		
	stp #10, #1		
out5	stp #20, #2

search  jmz.f   search, {count          
count   sne.i   #-310, {count           
        jmp     $0, {count

end start
;END boot
