;redcode
;name El fatale
;author Sascha Zapf
;strategy First entry for IRC Mini No.: 8
;       CORESIZE==800
;assert 1

       ORG      START
       ADD.AB #   328, $     2
       SPL.B  $    -3, $     0
       MOV.I  <     4, $     3
START  SPL.B  $    -3, $     0
       ADD.AB #   328, $     2
       END
