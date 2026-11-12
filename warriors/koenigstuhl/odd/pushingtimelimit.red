;redcode-94
;name pushing the time limit
;author John Metcalf
;strategy quick bit of bombing
;assert 1

first:
attk2: mov   jbomb,  first+14
       mov   jbomb,  first+17
       mov   dbomb,  }dbomb
       jmp   -1
start: spl   attk2,  <first+15
       mov   jbomb,  first+12
       mov   dbomb,  >dbomb
       jmp   -1
jbomb: jmp   #1,     1
dbomb: dat   1,      10
       end start
