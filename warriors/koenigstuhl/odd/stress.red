;redcode-94wierd
;name Stress!!!
;author John Metcalf
;strategy begins with ins[18], simple clear!
;assert 1

inst1:mov 3,>-4
      jmp 1,1
inst2:djn -1,>-5
      sub 3,3
      div 1,1
inst4:dat #0,10 ; replaced with dat
inst3:jmp -1,>-50
      div 2,2
      slt 1,1
start:mov.i inst4,{boot
      mov.i inst3,{boot
      mul.x {-25,{-46
      sub.x {-68,{-89
      mov.i inst2,{boot
      mov.i inst1,{boot
boot: jmz 80,#0
      end start
