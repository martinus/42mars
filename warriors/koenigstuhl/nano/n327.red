;redcode-nano
;name The pink spider 2
;author Christian Schmidt
;strategy nano LP paper
;assert 1

length equ 8
dist   equ 35
bmb1   equ 70
bmb2   equ 30


paper mov.ab  #length,  #length
copy  mov.i   <paper,   {ptr
      jmn.b   copy,     paper
ptr   spl     dist,     <bmb1
      djn.f   paper,    <bmb2
