;redcode-94nop
;name stone test 2
;author John Metcalf
;assert CORESIZE==8000

     hop   equ 28        ; mod 4 - must be a small positive value
     step  equ 6088      ; mod 8

     spl   #1,       hop
loop:mov   db,       >hit+step-hop
hit: mov   -2,       @loop
     add   #step,    @hit
     djn.f loop,     <-1000
db:  dat   <5334,       <2667
     end

