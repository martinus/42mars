;redcode-94t quiet
;name The T Machine's slave
;author Zul Nadzri
;strategy Definition of slave: Gives hard time to others but,
;strategy willing to die for its master. Any question?
;strategy Let's ban slavery!
;strategy Jan 2004
;assert 1

PIN 3

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
	mov.i out3, out4
pom1	mov.i pat, out2
	mov.i pom2, pom1
	mov.i clr, a
	mov.i win, pom3
	mov.i dest-2, dest-7
pom2  dat >498, >1701
;      spl.i  #1,#1

FOR 12+40-6-1
      spl.a  #1,*1
      spl.b  #1,1
      spl.ab #1,@1
      spl.ba #1,}1
      spl.i  #1,#1
ROF
FOR 1      
      spl.i  #1,#1
ROF

;------ This is SureWin Technology -------------------
win	stp #30, #3
pat3	nop 0,0
	stp #39, #3


start	ldp #0, #0	
	sne.ab #-1, -1
pom3	jmp x1		
test	ldp #3, #0		
	seq.ab #30, -1	
out3	jmp boot, }4378	
	stp #39, #3		
zap5	ldp #1, #0		
out1	seq.ab #10, -1	
	jmp boot, >4000
out4	seq.ab #0, start	
	jmp win, >3500
x3	stp #10, #1		
zero	nop 0,0
	dat 0
x1	stp #30, #3	
out5	stp #10, #1		
	nop 0,0
	nop 0,0
	ldp #2,#0
	sne.ab #20,-1
	dat 0,0

search  jmz.f   search, {count          
count   sne.i   #-310, {count           
        jmp     $0, {count

end start
;end boot
