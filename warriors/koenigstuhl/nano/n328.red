;redcode-nano
;name The pink spider
;author Christian Schmidt
;strategy nano LP paper
;assert 1

length equ 15
dist   equ 36

paper mov.ab  #length,  #length
copy  mov.i   <paper,   <ptr
      jmn.b   copy,     paper
ptr   spl.a   @paper,   dist
      jmz.b   @ptr,     paper

