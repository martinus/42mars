;redcode-odd
;name Striker
;author John Metcalf
;strategy IRCT15, white warrior killer
;strategy back-tracker, don't know if it works
;assert CORESIZE==8000

find:jmz.f  #4000,      {find
back:add.a  #81,        find
     jmn.f  back,       *find
     sub.a  #10,        find
fa:  add.ab find,       #2722
loop:mov    3,          }find
     mov    2,          >fa
     jmp    loop,       <-999
     end
